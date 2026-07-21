
import colors from 'colors';
import server from './server';

const port = process.env.PORT || 4000;

server.listen(port, () => {
  console.log(colors.bgCyan.italic(`Server is running at http://localhost:${port}`));
});


https://teams.microsoft.com/meet/412509580895282?p=g6Ado3gdbmuUtBwgMu
