export interface SmartThingsDevice {
  deviceId: string;
  name: string;
  label?: string;
  manufacturerName?: string;
  deviceModel?: string;
  components?: Array<{ id: string; capabilities?: Array<{ id: string }> }>;
}

export interface SmartThingsGeolocation {
  latitude?: { value?: number; timestamp?: string };
  longitude?: { value?: number; timestamp?: string };
  accuracy?: { value?: number; timestamp?: string };
  lastUpdateTime?: { value?: string; timestamp?: string };
}
