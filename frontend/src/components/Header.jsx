export default function Header() {
    return (
        <header className="bg-slate-900 border-b border-slate-800 text-white px-4 py-2 shadow-lg flex justify-between items-center">
            <div className="flex items-center gap-2">
                <span className="text-lg">🚨</span>
                <h1 className="text-lg font-extrabold tracking-tight">Crisis Command</h1>
                <span className="text-[10px] font-mono font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full ml-1">
                    Autonomous Dispatch &bull; Round 2
                </span>
            </div>
            <div className="text-xs font-medium text-slate-400 font-mono">Team Neural Ninjas</div>
        </header>
    );
}
