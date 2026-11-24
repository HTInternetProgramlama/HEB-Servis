import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {findVehicleMedia,vehicleImage,vehicleMedia} from '../lib/vehicle-media';

test('görsel doğru marka, model ve yıl aralığıyla eşleşir',()=>{
 assert.equal(findVehicleMedia({brand:'Volkswagen',model:'Golf',year:2020})?.id,'golf-8');
 assert.equal(findVehicleMedia({brand:'Renault',model:'Mégane',year:2022})?.id,'megane-4');
 assert.equal(findVehicleMedia({brand:'Fiat',model:'Egea',year:2021})?.id,'egea-sedan');
 assert.equal(findVehicleMedia({brand:' Renault ',model:' CLIO ',year:2022})?.id,'clio-5');
});
test('bilinmeyen model, yanlış marka veya farklı nesil yerine farklı çizim atanmaz',()=>{
 assert.equal(findVehicleMedia({brand:'Renault',model:'Golf',year:2020}),undefined);
 assert.equal(findVehicleMedia({brand:'Volkswagen',model:'Golf',year:2005}),undefined);
 assert.equal(findVehicleMedia({brand:'Renault',model:'Clio',year:2017}),undefined);
 assert.equal(findVehicleMedia({brand:'Fiat',model:'Egea Cross',year:2021}),undefined);
});
test('her model kendi dosyasına eşlenir ve dosyası yereldedir',()=>{
 assert.equal(new Set(vehicleMedia.map(m=>m.src)).size,vehicleMedia.length);
 for(const media of vehicleMedia)assert.ok(existsSync('public'+media.src),media.src);
 assert.equal(findVehicleMedia({brand:'Toyota',model:'Corolla',year:2019})?.id,'corolla-e210');
});
test('eşleşmeyen modelde markasız genel çizim gösterilir',()=>{
 const sedan=vehicleImage({brand:'Honda',model:'Civic',year:2020});
 assert.equal(sedan.generic,true); assert.ok(sedan.src.includes('generic-sedan')); assert.ok(existsSync('public'+sedan.src));
 const suv=vehicleImage({brand:'Nissan',model:'Qashqai',year:2021});
 assert.ok(suv.src.includes('generic-suv')); assert.ok(existsSync('public'+suv.src));
 assert.equal(vehicleImage({brand:'Volkswagen',model:'Golf',year:2021}).generic,false);
});
