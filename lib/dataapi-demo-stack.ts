import cdk = require('@aws-cdk/core');
import s3 = require('@aws-cdk/aws-s3');
import apigateway = require('@aws-cdk/aws-apigateway');
import { IntegrationOptions, IntegrationResponse, MethodOptions, MethodResponse, EmptyModel } from '@aws-cdk/aws-apigateway';
import lambda = require('@aws-cdk/aws-lambda');
import iam = require('@aws-cdk/aws-iam');
import { ServicePrincipal } from '@aws-cdk/aws-iam';
import sqs = require('@aws-cdk/aws-sqs');
import { Duration } from '@aws-cdk/core';
import { stat } from 'fs';
import rds = require('@aws-cdk/aws-rds');
import { CfnDBCluster, DatabaseClusterEngine, DatabaseCluster, DatabaseSecret  } from '@aws-cdk/aws-rds';
import secretsmanager = require('@aws-cdk/aws-secretsmanager');
import { SecretRotation, SecretRotationApplication, SecretRotationOptions } from '@aws-cdk/aws-rds'
import { TIMEOUT } from 'dns';
import { AuroraServerless } from "./auroraserverless";


export class DataapiDemoStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    var aurora = new AuroraServerless(this,'aurora-serverless')

    //LAMBDA

    const demoLambda = new lambda.Function(this, 'demo', {
      runtime: lambda.Runtime.NODEJS_8_10,
      handler: 'demo.handler',
      code: lambda.Code.asset('./lambda'),
      environment: {
        DBCLUSTERARN: aurora.clusterarn,
        SECRETARN: aurora.secretarn
      },
      timeout: Duration.seconds(60)
    });

    const statement1 = new iam.PolicyStatement();
    statement1.addResources(aurora.secretarn);
    statement1.addActions('secretsmanager:GetSecretValue');
    demoLambda.addToRolePolicy(statement1);

    const statement2 = new iam.PolicyStatement();
    statement2.addResources(aurora.clusterarn)
    statement2.addActions('rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement', 'rds-data:BeginTransaction', 'rds-data:CommitTransaction', 'rds-data:RollbackTransaction');
    demoLambda.addToRolePolicy(statement2);

    //API GW
    const rootApi = new apigateway.RestApi(this, 'demo-api', {});
    const integration = new apigateway.LambdaIntegration(demoLambda);

    const demoApi = rootApi.root.addResource('demoapi');

    const demoResource = demoApi.addResource('demo');
    const demoMethod = demoResource.addMethod('GET', integration);
    
  } 
}
  