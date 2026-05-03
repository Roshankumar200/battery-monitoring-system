-- Battery Monitoring System Database Schema
-- SQLite initialization script

-- Battery Stations Table
CREATE TABLE IF NOT EXISTS batteries_batterystation (
    id CHAR(36) PRIMARY KEY,
    station_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    location VARCHAR(300),
    mqtt_broker VARCHAR(255) NOT NULL,
    mqtt_port INTEGER DEFAULT 1883,
    mqtt_topic VARCHAR(255) NOT NULL,
    mqtt_username VARCHAR(100),
    mqtt_password VARCHAR(100),
    voltage_min INTEGER DEFAULT 11000,
    voltage_max INTEGER DEFAULT 13500,
    temperature_min INTEGER DEFAULT 0,
    temperature_max INTEGER DEFAULT 450,
    soc_min INTEGER DEFAULT 20,
    soh_min INTEGER DEFAULT 80,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Battery Readings Table
CREATE TABLE IF NOT EXISTS batteries_batteryreading (
    id CHAR(36) PRIMARY KEY,
    station_id CHAR(36) NOT NULL,
    battery_id VARCHAR(50) NOT NULL,
    voltage INTEGER NOT NULL,
    temperature INTEGER NOT NULL,
    soc INTEGER NOT NULL,
    soh INTEGER NOT NULL,
    imp INTEGER NOT NULL,
    timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(station_id) REFERENCES batteries_batterystation(id) ON DELETE CASCADE
);

-- Battery Alerts Table
CREATE TABLE IF NOT EXISTS batteries_batteryalert (
    id CHAR(36) PRIMARY KEY,
    station_id CHAR(36) NOT NULL,
    battery_id VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    voltage INTEGER,
    temperature INTEGER,
    soc INTEGER,
    soh INTEGER,
    imp INTEGER,
    acknowledged BOOLEAN DEFAULT 0,
    acknowledged_at DATETIME,
    acknowledged_by VARCHAR(100),
    alert_time DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(station_id) REFERENCES batteries_batterystation(id) ON DELETE CASCADE
);

-- Battery Statistics Table
CREATE TABLE IF NOT EXISTS batteries_batterystatistics (
    id CHAR(36) PRIMARY KEY,
    station_id CHAR(36) NOT NULL,
    battery_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    avg_voltage REAL,
    min_voltage INTEGER,
    max_voltage INTEGER,
    avg_temperature REAL,
    min_temperature INTEGER,
    max_temperature INTEGER,
    avg_soc REAL,
    min_soc INTEGER,
    max_soc INTEGER,
    avg_soh REAL,
    min_soh INTEGER,
    max_soh INTEGER,
    alert_count INTEGER DEFAULT 0,
    critical_alerts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(station_id, battery_id, date),
    FOREIGN KEY(station_id) REFERENCES batteries_batterystation(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reading_station_timestamp ON batteries_batteryreading(station_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_reading_station_battery_timestamp ON batteries_batteryreading(station_id, battery_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alert_station_created ON batteries_batteryalert(station_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_severity_created ON batteries_batteryalert(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stats_station_date ON batteries_batterystatistics(station_id, date DESC);

-- Insert sample station data
INSERT OR IGNORE INTO batteries_batterystation (
    id, station_id, name, location, mqtt_broker, mqtt_port, mqtt_topic,
    voltage_min, voltage_max, temperature_min, temperature_max, soc_min, soh_min
) VALUES 
(
    '550e8400-e29b-41d4-a716-446655440001',
    'STN-01',
    'Main Station',
    'Building A, Floor 2',
    'localhost',
    1883,
    '/batteries/STN-01/data',
    11000,
    13500,
    0,
    450,
    20,
    80
),
(
    '550e8400-e29b-41d4-a716-446655440002',
    'STN-02',
    'Secondary Station',
    'Building B, Floor 1',
    'localhost',
    1883,
    '/batteries/STN-02/data',
    11000,
    13500,
    0,
    450,
    20,
    80
);
