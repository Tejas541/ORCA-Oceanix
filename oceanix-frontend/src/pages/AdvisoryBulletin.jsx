import React from 'react'
import { Printer, Download, Share2, CheckCircle, ShieldCheck, Map as MapIcon } from 'lucide-react'

export default function AdvisoryBulletin() {
  const printBulletin = () => window.print()

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-20 px-6 bg-mesh print:bg-white print:pt-0">
      <div className="max-w-4xl mx-auto">
        
        {/* 1. Action Header (Hidden on Print) */}
        <div className="flex justify-between items-center mb-8 print:hidden">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Official Advisory Bulletin</h2>
          <div className="flex gap-3">
             <button onClick={printBulletin} className="flex items-center gap-2 px-5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                <Printer size={16} /> Print / Export PDF
             </button>
             <button className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all">
                <Download size={16} /> Save to Cloud
             </button>
          </div>
        </div>

        {/* 2. THE BULLETIN (The actual document) */}
        <div className="bg-white shadow-2xl rounded-[2rem] border border-slate-100 p-12 relative overflow-hidden print:shadow-none print:border-none print:p-0">
          
          {/* Document Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-black rounded flex items-center justify-center text-white text-[10px] font-bold">OX</div>
                <span className="font-black text-xl tracking-tighter">OCEANIX INTELLIGENCE</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-widest">
                ISRO-INCOIS JOINT SATELLITE MARINE ADVISORY
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono text-slate-400 font-bold">BULLETIN ID: #INC-O3-9821</div>
              <div className="text-sm font-black text-slate-900">DATE: 31-AUG-2026</div>
            </div>
          </div>

          {/* Core Status Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="md:col-span-2">
               <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">Venture Status</span>
               <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">SAFE FOR VENTURE</h1>
               <p className="text-sm text-slate-500 leading-relaxed max-w-lg">
                 Based on current Oceansat-3 chlorophyll gradients and INSAT-3DR sea surface temperatures, coastal conditions near Kochi are stable for standard artisanal and commercial trawling operations.
               </p>
            </div>
            <div className="bg-slate-50 rounded-3xl p-6 flex flex-col items-center justify-center border border-slate-100">
               <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Verification Token</p>
               {/* Mock QR Code */}
               <div className="w-24 h-24 bg-white border border-slate-200 p-2 rounded-xl mb-2 flex items-center justify-center">
                  <div className="grid grid-cols-4 gap-1 opacity-20">
                    {[...Array(16)].map((_, i) => <div key={i} className="w-3 h-3 bg-black" />)}
                  </div>
               </div>
               <span className="text-[8px] font-mono text-slate-400">Scan for Real-time Provenance</span>
            </div>
          </div>

          {/* Data Table */}
          <div className="mb-12">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 border-l-4 border-blue-500 pl-3">Identified PFZ Zones</h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 text-[10px] font-black text-slate-400 uppercase">Target Species</th>
                  <th className="py-4 text-[10px] font-black text-slate-400 uppercase">Coordinates</th>
                  <th className="py-4 text-[10px] font-black text-slate-400 uppercase">Depth</th>
                  <th className="py-4 text-[10px] font-black text-slate-400 uppercase text-right">Confidence</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-700">
                <tr className="border-b border-slate-50">
                  <td className="py-4">Oil Sardine / Mackerel</td>
                  <td className="py-4 font-mono text-xs">10.51°N, 75.82°E</td>
                  <td className="py-4 font-mono text-xs">45 m</td>
                  <td className="py-4 text-emerald-500 text-right">98.2%</td>
                </tr>
                <tr className="border-b border-slate-50">
                  <td className="py-4">Yellowfin Tuna</td>
                  <td className="py-4 font-mono text-xs">11.12°N, 74.95°E</td>
                  <td className="py-4 font-mono text-xs">60 m</td>
                  <td className="py-4 text-emerald-500 text-right">89.4%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer Warning */}
          <div className="p-6 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-4">
            <ShieldCheck className="text-rose-500 shrink-0" size={24} />
            <div>
              <p className="text-[10px] font-black text-rose-500 uppercase mb-1 tracking-widest">IMBL Compliance Alert</p>
              <p className="text-xs text-rose-700 leading-relaxed">
                A 15 NM buffer zone is enforced near the India-Sri Lanka Maritime Boundary. Ensure your Vessel Tracking System (VTS) is operational. Proximity alerts are active.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center text-[9px] font-mono text-slate-300 uppercase">
            Generated by Oceanix Agentic Core — Distributed for Public Safety and Blue Economy Enhancement
          </div>

        </div>
      </div>
    </div>
  )
}