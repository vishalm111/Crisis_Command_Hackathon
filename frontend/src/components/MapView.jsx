import React, { Fragment, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import mockState from '../../../contracts/mock_state.json';

// High-contrast, visible pill badge marker with emoji + text ID
const createIcon = (emoji, color, label) => {
    return L.divIcon({
        className: 'custom-map-pill',
        html: `<div style="background-color: ${color}; color: #ffffff; font-weight: 800; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; line-height: 1; padding: 2.5px 6px; border-radius: 9999px; border: 1.5px solid #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.5); display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; transform: translate(-50%, -50%); text-shadow: 0 1px 2px rgba(0,0,0,0.8); cursor: pointer;"><span style="font-size: 12px; line-height: 1;">${emoji}</span><span>${label || ''}</span></div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
    });
};

const typeToEmoji = {
    medical: '🚑',
    fire: '🔥',
    rescue: '🏗️',
    hazmat: '☢️'
};

const resourceTypeToEmoji = {
    ambulance: '🚑',
    fire_engine: '🚒',
    rescue_team: '👷'
};

const getIncidentColor = (tier) => {
    switch (tier) {
        case 'critical': return '#ef4444'; // red-500
        case 'high': return '#f97316'; // orange-500
        case 'medium': return '#eab308'; // yellow-500
        default: return '#3b82f6'; // blue-500
    }
};

const getResourceColor = (status) => {
    switch (status) {
        case 'available': return '#10b981'; // emerald-500
        case 'en_route': return '#3b82f6'; // blue-500
        case 'on_scene': return '#8b5cf6'; // violet-500
        case 'unavailable': return '#64748b'; // slate-500
        default: return '#94a3b8';
    }
};

/**
/**
 * Automatically recalculates Leaflet view bounds and tiles on fullscreen toggle and window resize
 */
function MapResizer({ isFullscreen }) {
    const map = useMap();
    useEffect(() => {
        const invalidate = () => {
            if (map) {
                map.invalidateSize();
            }
        };

        // Immediate and staged invalidations ensure tiles render without gray blanks
        invalidate();
        const t1 = setTimeout(invalidate, 50);
        const t2 = setTimeout(invalidate, 150);
        const t3 = setTimeout(invalidate, 300);

        window.addEventListener('resize', invalidate);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            window.removeEventListener('resize', invalidate);
        };
    }, [isFullscreen, map]);
    return null;
}

export default function MapView({ state }) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const data = state || mockState;

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen]);

    // Lock body scrolling when fullscreen overlay is active
    useEffect(() => {
        if (isFullscreen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isFullscreen]);

    if (!data || !data.incidents) {
        return (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 h-[380px] flex items-center justify-center">
                Loading geospatial map data...
            </div>
        );
    }

    const center = [12.97, 77.59]; // Central Bengaluru

    return (
        <div
            className={`transition-all duration-200 flex flex-col ${
                isFullscreen
                    ? 'fixed inset-0 z-[9999] bg-slate-950 p-4 h-screen w-screen overflow-hidden shadow-2xl'
                    : 'bg-slate-900 p-3 shadow-xl rounded-xl border border-slate-800 text-slate-100 h-[400px] relative'
            }`}
        >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-xs sm:text-sm font-semibold tracking-tight text-white flex items-center gap-1.5 truncate">
                        <span>🗺️</span> Bengaluru Emergency Geospatial Map
                    </h2>
                    {isFullscreen && (
                        <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full shrink-0">
                            FULL SCREEN
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-[10px] sm:text-[11px] font-mono text-slate-400">
                        {data.incidents?.length || 0} inc &bull; {data.resources?.length || 0} units
                    </div>

                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
                            isFullscreen
                                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
                        }`}
                        title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Expand to Fullscreen'}
                    >
                        <span>{isFullscreen ? '✕' : '⛶'}</span>
                        <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 rounded-lg overflow-hidden relative border border-slate-800">
                <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%', backgroundColor: '#1e293b' }}>
                    <MapResizer isFullscreen={isFullscreen} />
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    />
                    
                    {/* Incidents */}
                    {data.incidents.map(inc => (
                        <Marker 
                            key={`inc-${inc.id}`} 
                            position={[inc.location.lat, inc.location.lng]}
                            icon={createIcon(typeToEmoji[inc.type] || '❓', getIncidentColor(inc.tier), inc.id)}
                        >
                            <Popup>
                                <div className="text-xs font-sans text-slate-900">
                                    <strong className="text-sm">{inc.id} ({inc.type})</strong><br/>
                                    <span className="font-semibold">Tier:</span> {inc.tier}<br/>
                                    <span className="text-slate-600">{inc.description}</span>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Facilities */}
                    {data.facilities && data.facilities.map(fac => (
                        <Marker 
                            key={`fac-${fac.id}`} 
                            position={[fac.location.lat, fac.location.lng]}
                            icon={createIcon(fac.kind === 'hospital' ? '🏥' : '⛺', '#ec4899', fac.id || fac.name)}
                        >
                            <Popup>
                                <div className="text-xs font-sans text-slate-900">
                                    <strong className="text-sm">{fac.name}</strong><br/>
                                    <span className="font-semibold">Kind:</span> {fac.kind}<br/>
                                    <span>Load: {fac.load} / {fac.capacity}</span>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Resources & Assignment Lines */}
                    {data.resources && data.resources.map(res => {
                        const position = [res.location.lat, res.location.lng];
                        let assignedIncident = null;
                        
                        if (res.assigned_incident_id) {
                            assignedIncident = data.incidents.find(i => i.id === res.assigned_incident_id);
                        }

                        return (
                            <Fragment key={`res-group-${res.id}`}>
                                <Marker 
                                    position={position}
                                    icon={createIcon(resourceTypeToEmoji[res.type] || '🚚', getResourceColor(res.status), res.id)}
                                    zIndexOffset={100}
                                >
                                    <Popup>
                                        <div className="text-xs font-sans text-slate-900">
                                            <strong className="text-sm">{res.id}: {res.name}</strong><br/>
                                            <span>Status: {res.status}</span><br/>
                                            <span>Assigned to: {res.assigned_incident_id || 'None'}</span>
                                        </div>
                                    </Popup>
                                </Marker>
                                
                                {assignedIncident && (
                                    <Polyline 
                                        positions={[position, [assignedIncident.location.lat, assignedIncident.location.lng]]}
                                        pathOptions={{ color: getResourceColor(res.status), weight: 3, dashArray: res.status === 'en_route' ? '5, 5' : '1' }}
                                    />
                                )}
                            </Fragment>
                        );
                    })}
                </MapContainer>
                
                {/* Legend - positioned within map canvas */}
                <div className="absolute bottom-2.5 left-2.5 bg-slate-950/85 backdrop-blur-md p-2 rounded-lg shadow-xl border border-slate-700 text-[10px] z-[1000] pointer-events-auto text-slate-300 font-sans">
                    <div className="font-bold mb-1 border-b border-slate-800 pb-0.5 text-slate-200 flex items-center justify-between gap-4">
                        <span>MAP LEGEND</span>
                        <span className="text-[9px] text-slate-500 font-normal">Active Units</span>
                    </div>
                    <div className="flex gap-3">
                        <div>
                            <div className="font-semibold text-slate-400 uppercase text-[9px] mb-0.5">Incidents</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> Critical</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span> High</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"></span> Medium</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> Low</div>
                        </div>
                        <div>
                            <div className="font-semibold text-slate-400 uppercase text-[9px] mb-0.5">Resources</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Available</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> En Route</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block"></span> On Scene</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block"></span> Offline</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
