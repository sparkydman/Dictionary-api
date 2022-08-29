const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const WordModel = require('./wordModel');
const http = require('http');

dotenv.config('env');

const wordMiddleware = async (_req, res, next) => {
  try {
    http.get({ host: 'api.ipify.org', port: 80, path: '/' }, function (resp) {
      resp.on('data', async function (ip) {
        const location = await getLocation(ip.toString());
        if (!location?.canAccess) {
          return res
            .status(401)
            .send(
              `Your's location ${location.country} cannot access our service`
            );
        }
      });
    });
    next();
  } catch (error) {
    next(error);
  }
};

const errorHandler = async (error, _req, res, _next) =>
  res.status(500).send(error.message);

mongoose.connect(
  process.env.MONGO_URI,
  {
    autoIndex: true,
  },
  () => console.log('mongodb connected')
);

const app = express();

app.use(express.json());

const limiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply the rate limiting middleware to all requests
app.use(limiter);

app.get('/search', wordMiddleware, async (req, res) => {
  try {
    const response = await getWord(req.query.word);
    if (response && response.length > 0) {
      return res.send(response);
    }
    res.status(404).send('No result found');
  } catch (error) {
    console.log(error);
    res.send(error.message);
  }
});

app.get('/get-favorite/:word', wordMiddleware, async (req, res) => {
  try {
    const response = await getWord(req.params.word);
    if (response && response.length > 0) {
      return res.send(response);
    }
    res.status(404).send('No result found');
  } catch (error) {
    console.log(error);
    res.send(error.message);
  }
});

app.post('/add-favorite', async (req, res) => {
  try {
    if (!req.body?.word) {
      return res.status(400).send('Word is required');
    }
    const word = await WordModel.create(req.body);
    res.send(word);
  } catch (error) {
    console.log(error);
    res.send(error.message);
  }
});

app.get('/get-favorites', async (req, res) => {
  try {
    const words = await WordModel.find({});
    res.send(words);
  } catch (error) {
    console.log(error);
    res.send(error.message);
  }
});

app.delete('/remove-favorite/:id', async (req, res) => {
  try {
    if (!req.params?.id) {
      return res.status(400).send('Id of the word is required');
    }
    const word = await WordModel.findByIdAndDelete(req.params.id);
    res.send(word);
  } catch (error) {
    console.log(error);
    res.send(error.message);
  }
});

app.use('*', errorHandler);

app.listen(5050, () => console.log('hello listening on 5050'));

const getWord = async (word) => {
  const key = process.env.WORD_API_KEY;
  const url = process.env.WORD_API_URL;
  const host = process.env.WORD_API_HOST;
  axios.defaults.headers.common['X-RapidAPI-Key'] = key;
  axios.defaults.headers.common['X-RapidAPI-Host'] = host;
  try {
    const { data } = await axios.get(`${url}/${word}`);
    if (data.results && data.results.length > 0) {
      const responds = data.results.map((rs) => ({
        definition: rs.definition,
        partOfSpeech: rs.partOfSpeech,
        synonyms: rs.synonyms,
      }));
      return responds;
    }
    return null;
  } catch (error) {
    throw Error(error);
  }
};

const getLocation = async (ip) => {
  const key = process.env.LOCATION_API_KEY;
  const url = process.env.LOCATION_API_URL;
  console.log('location: ', ip);
  try {
    const { data } = await axios.get(`${url}?ip=${ip}&auth=${key}`);
    if (!data) throw Error('Can not resolve IP');
    return {
      canAccess: ['Nigeria', 'United States'].some((c) => c === data.country),
      country: data.country,
    };
  } catch (error) {
    throw Error(error);
  }
};
