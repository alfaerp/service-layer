import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

describe('forRoot()', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule.withForRoot()],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it(`should load configuration with "forRoot()"`, () => {
    const baseUrl = app.get(AppModule).getBaseUrl();
    console.log(baseUrl);
    expect(baseUrl).toEqual('https://177.85.35.34');
  });

  afterEach(async () => {
    await app.close();
  });
});
