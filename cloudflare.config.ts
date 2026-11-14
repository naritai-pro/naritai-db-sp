import { defineConfig } from "cf/config";

export default defineConfig({
	accountId: "db088f89c8f40a54b73ac6d02390d35a",
	worker: {
		name: "naritai-db-sp",
		compatibilityDate: "2026-11-12",
		assets: {
			notFoundHandling: "single-page-application",
		},
	},
});
