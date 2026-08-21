const Category = require('../models/Category');

// Get all categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories.map(c => ({ id: c._id, name: c.name, icon: c.icon })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
};

// Add a category
exports.createCategory = async (req, res) => {
  const { name, icon } = req.body;
  if (!name || !icon) {
    return res.status(400).json({ error: 'Name and icon are required.' });
  }

  try {
    const normalized = name.toLowerCase().trim();
    const categories = await Category.find();
    if (categories.some(c => c.name.toLowerCase().trim() === normalized)) {
      return res.status(400).json({ error: 'Category already exists.' });
    }

    const id = 'cat-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await Category.create({ _id: id, name: name.trim(), icon: icon.trim() });

    const updated = await Category.find();
    res.status(201).json(updated.map(c => ({ id: c._id, name: c.name, icon: c.icon })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create category.' });
  }
};
