const Car = require('../models/Car');
const Part = require('../models/Part');

const sampleCars = [
  {
    name: 'Nissan 350Z',
    brand: 'Nissan',
    category: 'sport',
    engineCc: 350,
    image: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=900&q=60',
    model3d: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=900&q=60',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb'
  },
  {
    name: 'Porsche 911',
    brand: 'Porsche',
    category: 'sport',
    engineCc: 911,
    image: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=900&q=60',
    model3d: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
    thumbnailUrl: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=900&q=60',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb'
  }
];

const sampleParts = [
  {
    name: 'Wheels A (demo)',
    type: 'wheels',
    thumbnailUrl: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=900&q=60',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb'
  },
  {
    name: 'Bodykit A (demo)',
    type: 'bodykit',
    thumbnailUrl: 'https://images.unsplash.com/photo-1617814076367-b759c7b7e738?auto=format&fit=crop&w=900&q=60',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Avocado/glTF-Binary/Avocado.glb'
  }
];

const seedIfEmpty = async () => {
  const carCount = await Car.countDocuments();
  if (carCount === 0) {
    await Car.insertMany(sampleCars);
    console.log('Seeded cars');
  }

  const partCount = await Part.countDocuments();
  if (partCount === 0) {
    await Part.insertMany(sampleParts);
    console.log('Seeded parts');
  }
};

module.exports = { seedIfEmpty };
