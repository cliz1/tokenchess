import './App.css'
//import AnalysisBoard from "./components/AnalysisBoard"
import Knook from "./components/Knook";

function App() {
  return (
    <div>
      <Knook
        initialFen="W3k3/8/P7/8/8/7p/8/4K3 b - - 0 1"
        orientation="white"
        onMove={(from, to) => {
          console.log(`Moved from ${from} to ${to}`);
        }}
      />
    </div>
  );
}

export default App
