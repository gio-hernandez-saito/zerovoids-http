import type {
	StandardSchemaV1,
	TransportRequest,
	TransportResponse,
} from "./types.js";

export type PluginContext = {
	url: string;
	request: TransportRequest;
	response?: TransportResponse;
	attempt: number;
};

export type Plugin = {
	id: string;
	name?: string;
	init?: (
		url: string,
		options: TransportRequest,
	) => Promise<{ url: string; options: TransportRequest }>;
	hooks?: {
		onRequest?: (ctx: PluginContext) => Promise<PluginContext> | PluginContext;
		onResponse?: (ctx: PluginContext) => Promise<PluginContext> | PluginContext;
		onError?: (ctx: PluginContext & { error: unknown }) => Promise<void> | void;
		onSuccess?: (ctx: PluginContext) => Promise<PluginContext> | PluginContext;
	};
	getOptions?: () => StandardSchemaV1;
};

export function definePlugin(plugin: Plugin): Plugin {
	return plugin;
}
