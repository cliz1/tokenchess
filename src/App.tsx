import './App.css'
import AnalysisBoard from "./components/AnalysisBoard"
import Knook from "./components/Knook";

function App() {
  return (
    <div>
      <Knook
        initialFen="1k2a3/1b6/8/8/8/8/4N3/4AK2 w - - 0 1"
        orientation="white"
        onMove={(from, to) => {
          console.log(`Moved from ${from} to ${to}`);
        }}
      />
    </div>
  );
}

export default App
