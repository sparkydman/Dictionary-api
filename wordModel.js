const mongoose = require('mongoose');

const wordModel = mongoose.Schema(
  {
    word: {
      type: String,
      require: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Word', wordModel);
