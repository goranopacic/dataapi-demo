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
import elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');
import targets = require('@aws-cdk/aws-elasticloadbalancingv2-targets');
import ec2 = require('@aws-cdk/aws-ec2');
import { SubnetType } from '@aws-cdk/aws-ec2';



export class DataapiDemoStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //NEW VPC
    const vpc = new ec2.Vpc(this, "movpc",{
      maxAzs: 2
    });
      
    //AURORA
    var aurora = new AuroraServerless(this,'aurora-serverless', {
      vpc: vpc,
      clusterName: 'demoapi'
    })

    //LAMBDA

    const demoLambda = new lambda.Function(this, 'demo', {
      runtime: lambda.Runtime.NODEJS_8_10,
      handler: 'demo.handler',
      code: lambda.Code.asset('./lambda'),
      environment: {
        DBCLUSTERARN: aurora.clusterarn,
        DBCLUSTERID: aurora.clusterid,
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

    const statement3 = new iam.PolicyStatement();
    statement3.addResources(aurora.clusterarn)
    statement3.addActions('rds:DescribeDBClusters');
    demoLambda.addToRolePolicy(statement3);

    //API GW
    /*
    const rootApi = new apigateway.RestApi(this, 'demo-api', {});
    const integration = new apigateway.LambdaIntegration(demoLambda);

    const demoApi = rootApi.root.addResource('demoapi');

    const demoResource = demoApi.addResource('demo');
    const demoMethod = demoResource.addMethod('GET', integration);
    */
    
    //ALB
    const securityGroup = new ec2.SecurityGroup(this, 'websecurity', { 
      vpc, 
      allowAllOutbound: false,
    });  
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));

    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LB', {
      vpc,
      internetFacing: true,
      securityGroup: securityGroup
    }
    );

    const listener = loadBalancer.addListener('Listener', { port: 80 });
    listener.addTargets('Targets', {
        targets: [new targets.LambdaTarget(demoLambda)]
    });

    new cdk.CfnOutput(this,'ALBHttpEndPoint', {
      value: loadBalancer.loadBalancerDnsName
  })

  } 
}
  