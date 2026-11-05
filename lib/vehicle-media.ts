import type {Vehicle} from './types';

export interface VehicleMedia {
 id:string; brand:string; models:string[]; from:number; to:number;
 label:string; src:string; tile:0|1|2|3;
}
export const vehicleMedia:VehicleMedia[]=[
 {id:'golf-8',brand:'volkswagen',models:['golf','golf 8','golf viii'],from:2020,to:2023,label:'Golf VIII',src:'/vehicles/model-illustrations-v2.png',tile:0},
 {id:'megane-4',brand:'renault',models:['megane','megane sedan','megane 4','megane iv'],from:2021,to:2023,label:'Megane IV Sedan',src:'/vehicles/model-illustrations-v2.png',tile:1},
 {id:'egea-sedan',brand:'fiat',models:['egea','egea sedan','tipo','tipo sedan'],from:2021,to:2023,label:'Egea Sedan',src:'/vehicles/model-illustrations-v2.png',tile:2},
 {id:'clio-5',brand:'renault',models:['clio','clio 5','clio v'],from:2020,to:2022,label:'Clio V',src:'/vehicles/model-illustrations-v2.png',tile:3},
];
const normalize=(text:string)=>text.trim().toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/\s+/g,' ');
// Each supported model uses its own illustration; unknown variants stay unassigned.
export function findVehicleMedia(vehicle:Pick<Vehicle,'brand'|'model'|'year'>){
 const brand=normalize(vehicle.brand)==='vw'?'volkswagen':normalize(vehicle.brand);
 return vehicleMedia.find(m=>m.brand===brand&&m.models.includes(normalize(vehicle.model))&&vehicle.year>=m.from&&vehicle.year<=m.to);
}

