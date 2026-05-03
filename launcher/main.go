package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	_ "embed"
)

//go:embed runtime_payload.zip
var embeddedRuntimeZip []byte

type launcherConfig struct {
	BackendAddress        string `json:"backend_address"`
	FrontendAddress       string `json:"frontend_address"`
	OpenBrowser           bool   `json:"open_browser"`
	StartupTimeoutSeconds int    `json:"startup_timeout_seconds"`
	DataDir               string `json:"data_dir"`
}

type managedProcess struct {
	name string
	cmd  *exec.Cmd
	done chan error
}

func main() {
	exePath, err := os.Executable()
	if err != nil {
		fatalf("resolve executable path: %v", err)
	}

	baseDir := filepath.Dir(exePath)
	config := loadConfig(filepath.Join(baseDir, "launcher.json"), defaultConfig(baseDir))
	if config.StartupTimeoutSeconds <= 0 {
		config.StartupTimeoutSeconds = 180
	}

	bundleDir := filepath.Join(defaultDataDir(), "bundle")
	if err := extractEmbeddedRuntime(bundleDir); err != nil {
		fatalf("extract runtime: %v", err)
	}

	backend := filepath.Join(bundleDir, "runtime", "backend.exe")
	nodeExe := filepath.Join(bundleDir, "runtime", "nodejs", "node.exe")
	frontendDir := filepath.Join(bundleDir, "runtime", "frontend")

	if _, err := os.Stat(backend); err != nil {
		fatalf("backend executable not found: %s", backend)
	}
	if _, err := os.Stat(nodeExe); err != nil {
		fatalf("frontend runtime not found: %s", nodeExe)
	}
	if _, err := os.Stat(filepath.Join(frontendDir, "server.js")); err != nil {
		fatalf("frontend server not found: %s", filepath.Join(frontendDir, "server.js"))
	}

	dataDir := config.DataDir
	if dataDir == "" {
		dataDir = defaultDataDir()
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		fatalf("prepare data dir: %v", err)
	}

	backendProc, err := startManagedProcess("backend", backend, []string{
		"BMS_PACKAGED_MODE=1",
		"MQTT_AUTOSTART=1",
		"BMS_DATA_DIR=" + dataDir,
		"BMS_HOST=127.0.0.1",
		"BMS_PORT=8000",
	}, filepath.Dir(backend))
	if err != nil {
		fatalf("start backend: %v", err)
	}
	defer backendProc.kill()

	if err := waitForPort(config.BackendAddress, time.Duration(config.StartupTimeoutSeconds)*time.Second); err != nil {
		fatalf("wait for backend: %v", err)
	}

	frontendProc, err := startManagedProcess("frontend", nodeExe, []string{
		"NEXT_PUBLIC_API_URL=http://127.0.0.1:8000",
		"PORT=3000",
		"HOSTNAME=127.0.0.1",
		"NODE_ENV=production",
	}, frontendDir, "server.js")
	if err != nil {
		fatalf("start frontend: %v", err)
	}
	defer frontendProc.kill()

	if err := waitForPort(config.FrontendAddress, time.Duration(config.StartupTimeoutSeconds)*time.Second); err != nil {
		fatalf("wait for frontend: %v", err)
	}

	if config.OpenBrowser {
		if err := openBrowser("http://" + config.FrontendAddress); err != nil {
			fmt.Fprintf(os.Stderr, "warning: open browser: %v\n", err)
		}
	}

	signalCh := make(chan os.Signal, 1)
	signal.Notify(signalCh, os.Interrupt, syscall.SIGTERM)

	select {
	case sig := <-signalCh:
		fmt.Fprintf(os.Stdout, "received %s, shutting down...\n", sig)
	case err := <-backendProc.done:
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s exited with error: %v\n", backendProc.name, err)
		} else {
			fmt.Fprintf(os.Stdout, "%s exited, shutting down...\n", backendProc.name)
		}
	case err := <-frontendProc.done:
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s exited with error: %v\n", frontendProc.name, err)
		} else {
			fmt.Fprintf(os.Stdout, "%s exited, shutting down...\n", frontendProc.name)
		}
	}

	backendProc.kill()
	frontendProc.kill()
}

func defaultConfig(baseDir string) launcherConfig {
	return launcherConfig{
		BackendAddress:        "127.0.0.1:8000",
		FrontendAddress:       "127.0.0.1:3000",
		OpenBrowser:           true,
		StartupTimeoutSeconds:  180,
		DataDir:               "",
	}
}

func loadConfig(path string, fallback launcherConfig) launcherConfig {
	file, err := os.Open(path)
	if err != nil {
		return fallback
	}
	defer file.Close()

	config := fallback
	if err := json.NewDecoder(file).Decode(&config); err != nil {
		return fallback
	}
	return config
}

func extractEmbeddedRuntime(targetRoot string) error {
	runtimeRoot := filepath.Join(targetRoot, "runtime")
	if err := os.MkdirAll(runtimeRoot, 0o755); err != nil {
		return err
	}

	archiveReader, err := zip.NewReader(bytes.NewReader(embeddedRuntimeZip), int64(len(embeddedRuntimeZip)))
	if err != nil {
		return err
	}

	for _, file := range archiveReader.File {
		cleanName := filepath.Clean(file.Name)
		if cleanName == "." || cleanName == string(filepath.Separator) {
			continue
		}

		destinationPath := filepath.Join(runtimeRoot, cleanName)
		if !strings.HasPrefix(filepath.Clean(destinationPath)+string(filepath.Separator), filepath.Clean(runtimeRoot)+string(filepath.Separator)) && filepath.Clean(destinationPath) != filepath.Clean(runtimeRoot) {
			return fmt.Errorf("invalid archive path: %s", file.Name)
		}

		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(destinationPath, 0o755); err != nil {
				return err
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(destinationPath), 0o755); err != nil {
			return err
		}

		rc, err := file.Open()
		if err != nil {
			return err
		}

		out, err := os.Create(destinationPath)
		if err != nil {
			rc.Close()
			return err
		}

		if _, err := io.Copy(out, rc); err != nil {
			_ = out.Close()
			_ = rc.Close()
			return err
		}
		if err := out.Close(); err != nil {
			_ = rc.Close()
			return err
		}
		if err := rc.Close(); err != nil {
			return err
		}
	}

	return nil
}

func startManagedProcess(name, executable string, extraEnv []string, workDir string, args ...string) (*managedProcess, error) {
	cmd := exec.Command(executable, args...)
	cmd.Dir = workDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = append(os.Environ(), extraEnv...)
	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	}

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	process := &managedProcess{
		name: name,
		cmd:  cmd,
		done: make(chan error, 1),
	}

	go func() {
		process.done <- cmd.Wait()
	}()

	return process, nil
}

func (p *managedProcess) kill() {
	if p == nil || p.cmd == nil || p.cmd.Process == nil {
		return
	}
	_ = p.cmd.Process.Kill()
}

func waitForPort(address string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	var lastErr error
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", address, 2*time.Second)
		if err == nil {
			_ = conn.Close()
			return nil
		}
		lastErr = err
		time.Sleep(750 * time.Millisecond)
	}
	if lastErr == nil {
		lastErr = errors.New("timed out waiting for port")
	}
	return fmt.Errorf("%s: %w", address, lastErr)
}

func openBrowser(targetURL string) error {
	if runtime.GOOS != "windows" {
		return exec.Command("xdg-open", targetURL).Start()
	}
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", targetURL).Start()
}

func defaultDataDir() string {
	if localAppData := os.Getenv("LOCALAPPDATA"); localAppData != "" {
		return filepath.Join(localAppData, "G3_BMS")
	}
	if appData := os.Getenv("APPDATA"); appData != "" {
		return filepath.Join(appData, "G3_BMS")
	}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		return filepath.Join(home, ".g3_bms")
	}
	return filepath.Join(os.TempDir(), "g3_bms")
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}

