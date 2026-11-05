import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {findVehicleMedia,vehicleMedia} from '../lib/vehicle-media';

test('görsel doğru marka, model ve yıl aralığıyla eşleşir',()=>{
 assert.equal(findVehicleMedia({brand:'Volkswagen',model:'Golf',year:2020})?.id,'golf-8');
 assert.equal(findVehicleMedia({brand:'Renault',model:'Mégane',year:2022})?.id,'megane-4');
 assert.equal(findVehicleMedia({brand:'Fiat',model:'Egea',year:2021})?.id,'egea-sedan');
 assert.equal(findVehicleMedia({brand:' Renault ',model:' CLIO ',year:2022})?.id,'clio-5');
});
test('bilinmeyen model, yanlış marka veya farklı nesil yerine farklı çizim atanmaz',()=>{
 assert.equal(findVehicleMedia({brand:'Renault',model:'Golf',year:2020}),undefined);
 assert.equal(findVehicleMedia({brand:'Volkswagen',model:'Golf',year:2005}),undefined);
 assert.equal(findVehicleMedia({brand:'Renault',model:'Clio',year:2024}),undefined);
 assert.equal(findVehicleMedia({brand:'Fiat',model:'Egea Cross',year:2021}),undefined);
});
test('her model ayrı çizim alanına eşlenir ve dosyası yereldedir',()=>{
 assert.equal(new Set(vehicleMedia.map(m=>m.tile)).size,4);
 for(const media of vehicleMedia){assert.ok(existsSync('public'+media.src),media.src);assert.ok(media.tile>=0&&media.tile<=3)}
});
