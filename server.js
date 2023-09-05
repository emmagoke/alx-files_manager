import express from 'express';
import router from './routes/index';

const app = express();
const port = process.env.PORT || 5000;

// Telling express how to handle the user payload
app.use(express.json());

// setting the route
app.use('/', router);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
