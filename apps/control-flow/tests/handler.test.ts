// tests/handler.test.js
import { expect, test, describe, beforeAll, afterAll, afterEach, beforeEach} from "vitest";
import { server } from '../src/mocks/server'; 

beforeAll(() => {
    server.listen();
});
afterEach(() => {
    server.resetHandlers();
});
afterAll(() => {
    server.close();
});

///////////// GET REQUESTS /////////////
describe('GET Requests', () => {
    let data: {key: string, value: string, readOnly: boolean}[];

    beforeEach(async() => {
        const response = await fetch('http://localhost:4040/api/mif/316');
        data = await response.json();
    })

    test('GET all variables from MIF API', async () => {
        expect(data.length).toBe(25);
    })

    test('GET Processes of Aquamesh 316', async () => {
        const firstAquamesh = data[0];

        expect(firstAquamesh.key).toBe('OPERATIONAL_SERVER_FAMILY');
        expect(firstAquamesh.value).toBe('PRIME');
        expect(firstAquamesh.readOnly).toBe(false)
    });

    test('GET filtered data', () => {
        const filteredRes = data.filter((instance) => instance.key.startsWith('STM'));
        
        expect(filteredRes.length).toBe(7);
    })
});

///////////// POST REQUESTS /////////////
describe('POST Requests', () => {
    test('POST Process to Aquamesh 316', async () => {
        const response = await fetch('http://localhost:4040/api/mif/316/', { method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "c30ce96f0fce27580bd3bd3501bc58867b023249b22bc7772f3a92ed7fa8f143"
            },
            body: JSON.stringify({ "action": "STOP" })
        })

        const data = await response.json();

        expect(data.content.action).toBe('STOP');
    });

    test('POST No Authorization', async () => {
        const response = await fetch('http://localhost:4040/api/mif/316', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ "action": "STOP" })
        });

        const data = await response.json();
        expect(data.error).toBe('Authorization header not present. Access denied.')
    });
    test('POST Wrong Authorization', async () => {
        const response = await fetch('http://localhost:4040/api/mif/316', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "123"
            },
            body: JSON.stringify({ "action": "STOP" })
        });

        const data = await response.json();
        expect(data.error).toBe('Incorrect token. Access denied.')
    });
});