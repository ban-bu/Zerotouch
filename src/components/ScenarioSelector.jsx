import React from 'react';
import { ChevronDown } from 'lucide-react';

const ScenarioSelector = ({ scenarios, currentScenario, onScenarioChange }) => {
  const current = scenarios[currentScenario]

  return (
    <div className="flex items-center space-x-2">
      {Object.values(scenarios).map((scenario) => {
        const isActive = scenario.id === currentScenario
        return (
          <button
            key={scenario.id}
            onClick={() => onScenarioChange(scenario.id)}
            className={
              `flex items-center space-x-2 px-4 py-3 rounded-2xl border transition-all duration-200 backdrop-blur-sm ` +
              (isActive
                ? 'bg-white/20 text-white border-white/50 shadow-lg backdrop-blur-md'
                : 'bg-white/10 text-white border-white/25 hover:bg-white/20 backdrop-blur-md')
            }
            title={scenario.description}
          >
            <div className={
              `p-1.5 rounded-xl transition-all duration-200 ` +
              (isActive
                ? 'bg-white/25 text-white backdrop-blur-sm'
                : 'bg-white/15 text-white backdrop-blur-sm')
            }>
              <scenario.icon className="w-4 h-4" />
            </div>
            <div className="text-sm font-medium">{scenario.name}</div>
          </button>
        )
      })}
    </div>
  )
}

export default ScenarioSelector