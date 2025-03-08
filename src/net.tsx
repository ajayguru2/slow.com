import { ActionPanel, Action, List, Icon, Color, Detail } from "@raycast/api";
import React, { useEffect, useState } from "react";
import si from "systeminformation";
import ping from "ping";

interface NetworkStats {
  downloadSpeed: string;
  uploadSpeed: string;
  latency: string;
  networkType: string;
  ipAddress: string;
  ssid?: string;
  signalStrength?: string;
}

interface WifiNetwork {
  ssid: string;
  quality: number;
  iface: string;
}

export default function Command() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getNetworkSpeed = async () => {
    try {
      const networkStats = await si.networkStats();
      const mainInterface = Array.isArray(networkStats) ? networkStats[0] : networkStats;

      // Convert bytes/sec to Mbps
      const downloadSpeed = ((mainInterface.rx_sec || 0) * 8) / (1024 * 1024);
      const uploadSpeed = ((mainInterface.tx_sec || 0) * 8) / (1024 * 1024);

      return {
        download: downloadSpeed.toFixed(2),
        upload: uploadSpeed.toFixed(2),
      };
    } catch (err) {
      console.error("Speed test error:", err);
      return {
        download: "0.00",
        upload: "0.00",
      };
    }
  };

  const getNetworkInfo = async () => {
    try {
      setIsLoading(true);

      // Get network interfaces
      const networkInterfaces = await si.networkInterfaces();
      const activeInterface = (Array.isArray(networkInterfaces) ? networkInterfaces : [networkInterfaces]).find(
        (iface) => iface.operstate === "up",
      );

      // Get WiFi networks if available
      const wifi = (await si.wifiNetworks()) as unknown as WifiNetwork[];
      const currentSsid = activeInterface?.ifaceName;
      const activeWifi = wifi.find((network) => network.iface === currentSsid);

      // Get current network speeds
      const speeds = await getNetworkSpeed();

      // Test latency
      const pingResult = await ping.promise.probe("8.8.8.8");

      setStats({
        downloadSpeed: `${speeds.download} Mbps`,
        uploadSpeed: `${speeds.upload} Mbps`,
        latency: `${pingResult.time} ms`,
        networkType: activeInterface?.type || "Unknown",
        ipAddress: activeInterface?.ip4 || "Unknown",
        ssid: activeWifi?.ssid,
        signalStrength: activeWifi ? `${activeWifi.quality}%` : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getNetworkInfo();
    const interval = setInterval(getNetworkInfo, 2000); // Update every 2 seconds for more responsive speed updates
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return <Detail markdown={`# Error\n${error}`} />;
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Network Statistics">
      <List.Section title="Network Status">
        <List.Item
          icon={{ source: Icon.Wifi, tintColor: Color.Green }}
          title="Download Speed"
          subtitle={stats?.downloadSpeed || "Measuring..."}
          accessories={[{ icon: Icon.ArrowDown }]}
        />
        <List.Item
          icon={{ source: Icon.Wifi, tintColor: Color.Blue }}
          title="Upload Speed"
          subtitle={stats?.uploadSpeed || "Measuring..."}
          accessories={[{ icon: Icon.ArrowUp }]}
        />
        <List.Item
          icon={{ source: Icon.Clock, tintColor: Color.Yellow }}
          title="Latency"
          subtitle={stats?.latency || "Measuring..."}
        />
        <List.Item
          icon={{ source: Icon.Network, tintColor: Color.Purple }}
          title="Network Type"
          subtitle={stats?.networkType || "Checking..."}
        />
        <List.Item
          icon={{ source: Icon.Globe, tintColor: Color.Orange }}
          title="IP Address"
          subtitle={stats?.ipAddress || "Checking..."}
        />
        {stats?.ssid && (
          <List.Item
            icon={{ source: Icon.Signal0, tintColor: Color.Red }}
            title="WiFi Network"
            subtitle={stats.ssid}
            accessories={[{ text: stats.signalStrength }]}
          />
        )}
      </List.Section>

      <List.Section title="Actions">
        <List.Item
          icon={Icon.Repeat}
          title="Refresh Statistics"
          actions={
            <ActionPanel>
              <Action title="Refresh" onAction={getNetworkInfo} />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}
