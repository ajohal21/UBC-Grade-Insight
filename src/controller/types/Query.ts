export type Query = {
	WHERE?: Record<string, any>;
	OPTIONS?: {
		COLUMNS?: string[];
		ORDER?: string | {
			dir: "UP" | "DOWN";
			keys: string[];
		};
	};
	TRANSFORMATIONS?: {
		GROUP: string[];
		APPLY: Array<Record<string, Record<string, string>>>;
	};
};
