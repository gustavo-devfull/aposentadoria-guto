import next from "eslint-config-next";

const config = [...next, { ignores: [".next/**", "db/migrations/**"] }];
export default config;
