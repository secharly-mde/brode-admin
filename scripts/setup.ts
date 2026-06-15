import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables before anything else
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
