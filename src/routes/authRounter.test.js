const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
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

beforeEach(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  DBconnection = await DB.getConnection();
});

afterEach(async () => {
  await DBconnection.close();
});

test('register', async () => {
  const registerRes = await request(app).post('/api/auth').send(testUser);
  expect(registerRes.status).toBe(200);
  expect(registerRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  expect(testUser.password).toBe(password);
  expect(registerRes.body.user).toMatchObject(user);
})

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  expect(testUser.password).toBe(password);
  expect(loginRes.body.user).toMatchObject(user);
});

test('logout', async () => {
  const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe('logout successful');
})

test('new admin user', async () => {
  const user = await createAdminUser();
  expect(user.roles[0].role).toBe(Role.Admin);
})

test('authorized update user', async () => {
  let testUserID = await DB.getID(DBconnection, 'email', testUser.email, 'user');
  const updateRes = await request(app).put(`/api/auth/${testUserID}`).set('Authorization', `Bearer ${testUserAuthToken}`).send({ email: 'reg2@test.com', password: 'ayah' });
  expect(updateRes.status).toBe(200);
})

test('unauthorized update user', async () => {
  let testUserID = await DB.getID(DBconnection, 'email', testUser.email, 'user');
  const updateRes = await request(app).put(`/api/auth/${testUserID - 1}`).set('Authorization', `Bearer ${testUserAuthToken}`).send({ email: 'reg2@test.com', password: 'ayah' });
  expect(updateRes.status).toBe(403);
})

