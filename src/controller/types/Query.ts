export type Query = {
	WHERE?: Record<string, any>;
	OPTIONS?: {
		COLUMNS?: string[];
		ORDER?: string | {
			dir: "UP" | "DOWN";
			keys: string[];
		};
	};
};
