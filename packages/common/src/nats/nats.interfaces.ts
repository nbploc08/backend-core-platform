export interface NatsStreamConfig {
  name: string;
  subjects: string[];
}

export interface NatsModuleOptions {
  serviceName: string;
  url?: string;
  streams?: NatsStreamConfig[];
}
