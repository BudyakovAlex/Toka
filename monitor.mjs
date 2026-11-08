// Manual read-only diagnostic. Production scheduling calls Vercel.
import {stations,readStation} from './lib/toka.mjs';
for(const st of stations)console.log(st.number,await readStation(st));
