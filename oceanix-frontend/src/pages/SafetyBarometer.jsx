import { MapContainer, TileLayer } from 'react-leaflet'
import { Activity, ShieldCheck, Wind, Waves, Zap, Map as MapIcon } from 'lucide-react'
import { useScenario } from '../context/ScenarioContext'

export default function SafetyBarometer() {
  const { selectedOperatingLocation, locationDecision } = useScenario()
  const decision = locationDecision?.decision ?? {
    riskLevel: 'DATA_INSUFFICIENT',
    safetyScore: null,
    ventureStatusLabel: 'DATA INSUFFICIENT',
    officialDirective: 'Required evidence unavailable for the selected operating location.',
  }
  const operatingLocationName = selectedOperatingLocation?.name ?? 'SELECT OPERATING LOCATION'
  const formatEvidenceValue = (value) => {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue.toFixed(4) : value
  }
  const evidenceValue = (parameter) => {
    if (!selectedOperatingLocation) return null
    const record = locationDecision?.evidence?.find(
      (item) => item.parameter === parameter && item.status === 'available'
    )
    return record?.value ?? null
  }

  if (!selectedOperatingLocation) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] pt-24 px-12 pb-12 flex items-center justify-center">
        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 text-center max-w-lg">
          <h1 className="text-2xl font-black text-slate-900">SELECT OPERATING LOCATION</h1>
          <p className="mt-3 text-sm text-slate-500">Choose an operating location on the Command Map before viewing safety status.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] pt-24 px-12 pb-12 bg-mesh">
      {/* Main Safety Analysis Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[80px] rounded-full" />
            
            <div className="flex items-start justify-between mb-12">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center text-4xl shadow-inner border border-emerald-200">
                  <ShieldCheck size={40} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{operatingLocationName}</p>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">{decision.ventureStatusLabel}</h2>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Prototype Safety Index</p>
                <div className="text-5xl font-black text-slate-900">
                  {decision.safetyScore == null ? '—' : decision.safetyScore}
                  {decision.safetyScore != null && <span className="text-xl text-slate-300">/100</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                { label: 'Wave Height', value: evidenceValue('waveHeight'), suffix: ' m', icon: <Waves size={16} /> },
                { label: 'Wind Speed', value: evidenceValue('windSpeed'), suffix: ' m/s', icon: <Wind size={16} /> },
                { label: 'Visibility', value: evidenceValue('visibility'), suffix: ' m', icon: <Activity size={16} /> },
                { label: 'Lightning Risk', value: evidenceValue('lightningRiskPercent'), suffix: '%', icon: <Zap size={16} /> }
              ].map((stat) => (
                <div key={stat.label} className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl">
                  <div className="text-slate-400 mb-3">{stat.icon}</div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{stat.value == null ? '—' : `${formatEvidenceValue(stat.value)}${stat.suffix}`}</p>
                </div>
              ))}
            </div>
            
            <div className="mt-10 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center gap-3">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                  {decision.riskLevel === 'DATA_INSUFFICIENT' ? 'Required evidence unavailable: ' : 'ORCA Guidance: '}{decision.officialDirective}
                </p>
            </div>
          </div>
        </div>

        {/* 3. Local Map Preview */}
        <div className="bg-white rounded-[2.5rem] p-4 shadow-xl border border-slate-100 h-full min-h-[400px] flex flex-col">
            <div className="p-4 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zone Monitoring</span>
                <MapIcon size={16} className="text-slate-300" />
            </div>
            <div className="flex-1 rounded-[1.8rem] overflow-hidden border border-slate-100">
                <MapContainer center={[selectedOperatingLocation.latitude, selectedOperatingLocation.longitude]} zoom={8} className="h-full w-full" zoomControl={false}>
                    <TileLayer
                      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="&copy; OpenStreetMap contributors"
                    />
                </MapContainer>
            </div>
        </div>
      </div>
    </div>
  )
}
