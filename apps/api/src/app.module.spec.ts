import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { KobaidService } from './modules/kobaid/kobaid.service';
import { CapabilityService } from './modules/accounts/capability.service';
import { InterestsValidator } from './modules/accounts/interests.validator';

describe('AppModule (DI wiring)', () => {
  it('resolves KobaidService, CapabilityService and InterestsValidator through Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef.get(KobaidService)).toBeInstanceOf(KobaidService);
    expect(moduleRef.get(CapabilityService)).toBeInstanceOf(CapabilityService);
    expect(moduleRef.get(InterestsValidator)).toBeInstanceOf(InterestsValidator);

    await moduleRef.close();
  });
});
