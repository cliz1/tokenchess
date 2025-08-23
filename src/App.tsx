import './App.css'
//import AnalysisBoard from "./components/AnalysisBoard"
import Knook from "./components/Knook";

function App() {
  return (
    <div>
      <Knook
        initialFen="1k6/6P1/8/8/8/8/5p2/1K6 w - - 0 1"
        orientation="white"
        onMove={(from, to) => {
          console.log(`Moved from ${from} to ${to}`);
        }}
      />
    </div>
  );
}

export default App
