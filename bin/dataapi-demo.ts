#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { DataapiDemoStack } from '../lib/dataapi-demo-stack';

const app = new cdk.App();
new DataapiDemoStack(app, 'DataapiDemoStack');
