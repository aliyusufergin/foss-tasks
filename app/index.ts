// UUID pks are generated on-device (ADR-0005 §1); react-native-get-random-values
// polyfills crypto.getRandomValues so `uuid` works in the RN runtime. Must be
// imported before anything that mints ids.
import "react-native-get-random-values";
import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
