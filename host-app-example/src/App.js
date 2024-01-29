import {
  MetabaseProvider,
  QueryVisualizationSdk,
} from "metabase-embedding-sdk";
import "metabase-embedding-sdk/dist/main.css";

import "./App.css";

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <p>
          Denis and Oisin are so cool!
        </p>
      </header>

      <MetabaseProvider
        apiUrl={"http://localhost:3000"}
        apiKey={"mb_FqhtoYzE5yotRQY/awukXR5O8OQpLiz1agJK4ucOCdk="}
      >
        TEST
        <QueryVisualizationSdk questionId={77} />
      </MetabaseProvider>
    </div>
  );
}

export default App;
