import React, { Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import mockState from '../../../contracts/mock_state.json';

// Define custom divIcons
const createIcon = (emoji, color, label) => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 14px;" title="${label}">${emoji}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
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
        case 'available': return '#22c55e'; // green-500
        case 'en_route': return '#3b82f6'; // blue-500
        case 'on_scene': return '#8b5cf6'; // violet-500
        case 'unavailable': return '#6b7280'; // gray-500
        default: return '#9ca3af';
    }
};

export default function MapView({ state }) {
    const data = state || mockState;

    if (!data || !data.incidents) {
        return <div className="p-4 bg-white shadow rounded border h-96 flex items-center justify-center">Loading map data...</div>;
    }

    const center = [12.97, 77.59]; // Central Bengaluru

    return (
        <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 h-[600px] flex flex-col relative">
            <h2 className="font-bold text-gray-800 uppercase tracking-wide text-sm mb-2">Map View</h2>
            <div className="flex-1 bg-[#e5e3df] rounded-md overflow-hidden relative">
                <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%', backgroundColor: 'transparent' }}>
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
                                <strong>{inc.id} ({inc.type})</strong><br/>
                                Tier: {inc.tier}<br/>
                                {inc.description}
                            </Popup>
                        </Marker>
                    ))}

                    {/* Facilities */}
                    {data.facilities && data.facilities.map(fac => (
                        <Marker 
                            key={`fac-${fac.id}`} 
                            position={[fac.location.lat, fac.location.lng]}
                            icon={createIcon(fac.kind === 'hospital' ? '🏥' : '⛺', '#ec4899', fac.id)} // pink-500
                        >
                            <Popup>
                                <strong>{fac.name}</strong><br/>
                                Kind: {fac.kind}<br/>
                                Load: {fac.load} / {fac.capacity}
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
                                        <strong>{res.id}: {res.name}</strong><br/>
                                        Status: {res.status}<br/>
                                        Assigned to: {res.assigned_incident_id || 'None'}
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
                
                {/* Legend - positioned absolutely within the map container area to hover over tiles */}
                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm p-3 rounded-md shadow-lg border border-gray-200 text-xs z-[1000] pointer-events-auto">
                    <div className="font-bold mb-2 border-b border-gray-200 pb-1 text-gray-700">Legend</div>
                    <div className="flex gap-6">
                        <div>
                            <div className="font-semibold mb-1 text-gray-600">Incidents</div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block shadow-sm"></span> Critical</div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block shadow-sm"></span> High</div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block shadow-sm"></span> Medium</div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block shadow-sm"></span> Low</div>
                        </div>
                        <div>
                            <div className="font-semibold mb-1 text-gray-600">Resources</div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block shadow-sm"></span> Available</div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block shadow-sm"></span> En Route</div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-3 h-3 rounded-full bg-violet-500 inline-block shadow-sm"></span> On Scene</div>
                            <div className="flex items-center gap-1.5 mb-1"><span className="w-3 h-3 rounded-full bg-gray-500 inline-block shadow-sm"></span> Unavailable</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
