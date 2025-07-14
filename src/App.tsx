import './App.css'
import AnalysisBoard from "./components/AnalysisBoard"

function App() {
  return (
    <div>
      <AnalysisBoard
        initialFen="start"
        orientation="white"
        onMove={(from, to) => {
          console.log(`Moved from ${from} to ${to}`);
        }}
      />
    </div>
  );
}

export default App
