import { Controller, Get, Header } from '@nestjs/common';
import {
  aboutPageHtml,
  accessibilityPageHtml,
  contactPageHtml,
  cookiePolicyHtml,
  feesLimitsPageHtml,
  helpPageHtml,
  pricingPageHtml,
  privacyPolicyHtml,
  publicSiteHtml,
  securityTrustPageHtml,
  termsPageHtml,
} from './public-site/public-site.frontend';

@Controller()
export class AppController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  root() {
    return publicSiteHtml();
  }

  @Get('pricing')
  @Header('Content-Type', 'text/html; charset=utf-8')
  pricing() {
    return pricingPageHtml();
  }

  @Get('fees-limits')
  @Header('Content-Type', 'text/html; charset=utf-8')
  feesLimits() {
    return feesLimitsPageHtml();
  }

  @Get('security')
  @Header('Content-Type', 'text/html; charset=utf-8')
  security() {
    return securityTrustPageHtml();
  }

  @Get('help')
  @Header('Content-Type', 'text/html; charset=utf-8')
  help() {
    return helpPageHtml();
  }

  @Get('contact')
  @Header('Content-Type', 'text/html; charset=utf-8')
  contact() {
    return contactPageHtml();
  }

  @Get('about')
  @Header('Content-Type', 'text/html; charset=utf-8')
  about() {
    return aboutPageHtml();
  }

  @Get('accessibility')
  @Header('Content-Type', 'text/html; charset=utf-8')
  accessibility() {
    return accessibilityPageHtml();
  }

  @Get('legal/privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  privacy() {
    return privacyPolicyHtml();
  }

  @Get('legal/terms')
  @Header('Content-Type', 'text/html; charset=utf-8')
  terms() {
    return termsPageHtml();
  }

  @Get('legal/cookies')
  @Header('Content-Type', 'text/html; charset=utf-8')
  cookies() {
    return cookiePolicyHtml();
  }

  @Get('api')
  apiRoot() {
    return {
      ok: true,
      service: 'kasicash-api',
    };
  }
}
