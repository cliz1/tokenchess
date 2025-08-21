import './App.css'
import AnalysisBoard from "./components/AnalysisBoard"
import Knook from "./components/Knook";

function App() {
  return (
    <div>
      <Knook
        initialFen="kh6/1r6/8/8/8/8/6R1/5HK1 w - - 0 1"
        orientation="white"
        onMove={(from, to) => {
          console.log(`Moved from ${from} to ${to}`);
        }}
      />
    </div>
  );
}

export default App
