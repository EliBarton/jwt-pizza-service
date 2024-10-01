const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

let testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a',  roles: [{ role: Role.Admin }]  };
const testFranchise = { id: 1, name: 'pizzaPocket', stores: [{ id: 1, name: 'SLC' }] }
let testUserAuthToken;
let testUserId;
let testFranchiseId;
let DBconnection;


async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';
  
    await DB.addUser(user);
  
    user.password = 'toomanysecrets';
    return user;
  }

  function randomName() {
    return Math.random().toString(36).substring(2, 12);
  }
  

beforeEach( async () => {
    DBconnection = await DB.getConnection();
    testUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send({ email: testUser.email, password: testUser.password });
    expect(loginRes.status).toBe(200);
    testUserAuthToken = loginRes.body.token;
    testUserId = await DB.getID(DBconnection, 'email', testUser.email, 'user');

    testFranchise.name = Math.random().toString(36).substring(2, 12) + ' test franchise';
    testFranchise.admins = [{email: testUser.email, name: testUser.name, id: testUserId}];
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send(testFranchise);
    expect(createFranchiseRes.status).toBe(200);
    testFranchiseId = createFranchiseRes.body.id;

    
  });
  
afterEach(async () => {
    DBconnection.close();
})

test('get entire franchise list', async () => {
    const franchiseList = await request(app).get('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(franchiseList.status).toBe(200);
    expect(franchiseList.body.length).toBeGreaterThan(0);
})

test('get users franchise list', async () => {
    const franchiseList = await request(app).get('/api/franchise/' + testUserId).set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(franchiseList.status).toBe(200);
    expect(franchiseList.body.length).toBeGreaterThan(0);
    expect(franchiseList.body[0].name).toBe(testFranchise.name);
})