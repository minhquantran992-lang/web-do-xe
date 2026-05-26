const { Car } = require('../models/Car');

const listCarsRaw = async () => Car.find({}).sort({ createdAt: -1 }).lean();

const listCarModelsRaw = async () =>
  Car.find({})
    .select('name brand category engineCc model3d modelUrl combinedModelSlots combinedModels combos createdAt updatedAt')
    .sort({ createdAt: -1 })
    .lean();

module.exports = { listCarsRaw, listCarModelsRaw };
