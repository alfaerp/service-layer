import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

describe('login()', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule.withForRoot()],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it(
    `should load configuration with "forRoot() and login"`,
    async () => {
      const result = await app.get(AppModule).login();
      expect(result).not.toBeNull();
    },
    1000 * 60 * 30,
  );

  it(
    `should load configuration with "forRoot() and get paths"`,
    async () => {
      let mymodule = app.get(AppModule);
      const result = await mymodule.getPath();
      expect(result).toBe('Alfa');
    },
    1000 * 60 * 30,
  );

  afterEach(async () => {
    await app.close();
  });
});
