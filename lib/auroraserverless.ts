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
import { CfnDBCluster, DatabaseClusterEngine, DatabaseCluster, DatabaseSecret, CfnDBSubnetGroup  } from '@aws-cdk/aws-rds';
import secretsmanager = require('@aws-cdk/aws-secretsmanager');
import { SecretRotation, SecretRotationApplication, SecretRotationOptions } from '@aws-cdk/aws-rds'
import {AttachmentTargetType, ISecretAttachmentTarget, SecretAttachmentTargetProps, SecretTargetAttachment} from "@aws-cdk/aws-secretsmanager";
import { TIMEOUT } from 'dns';
import ec2 = require('@aws-cdk/aws-ec2');
import {Connections, ISecurityGroup, IVpc, Port, SecurityGroup, SubnetSelection} from "@aws-cdk/aws-ec2";

export interface AuroraServerlessProps {
    readonly vpc: IVpc;
    readonly clusterName: string;
}

export class AuroraServerless extends cdk.Construct implements ISecretAttachmentTarget {

    public vpc: IVpc;
    public vpcSubnets: SubnetSelection;
    public securityGroup: ISecurityGroup;
    public securityGroupId: string;

    public secretarn: string;
    public clusterarn: string;
    public clusterid: string;

    constructor(scope: cdk.Construct, id: string, private props: AuroraServerlessProps) {
        super(scope, id);

        this.vpc = props.vpc;
        //this.vpcSubnets = props.subnets;
        
        const secret = new DatabaseSecret(this, "MasterUserSecretDemoDataApi", {
            username: "dbroot",
        });
        this.secretarn = secret.secretArn;
      
        new cdk.CfnOutput(this,'SecretARN', {
            value: secret.secretArn
        })

        const securityGroup = new SecurityGroup(this, "DatabaseSecurityGroup", {
            allowAllOutbound: true,
            description: `DB Cluster (${props.clusterName}) security group`,
            vpc: props.vpc
        });
        this.securityGroup = securityGroup;
        this.securityGroupId = securityGroup.securityGroupId;
    
        const dbcluster = new CfnDBCluster(this, 'apidbcluster', {       
            engine: 'aurora',
            engineMode: 'serverless',
            masterUsername: secret.secretValueFromJson("username").toString(),
            masterUserPassword: secret.secretValueFromJson("password").toString(),
            scalingConfiguration: {
                autoPause: true,
                minCapacity: 1,
                maxCapacity: 16,
                secondsUntilAutoPause: 300
            },
            dbSubnetGroupName: new CfnDBSubnetGroup(this, "db-subnet-group", {
                dbSubnetGroupDescription: `${props.clusterName} database cluster subnet group`,
                subnetIds: props.vpc.selectSubnets( {subnetType: ec2.SubnetType.PRIVATE }).subnetIds
            }).ref,
        });
    

    
        var region = cdk.Stack.of(this).region
        var account = cdk.Stack.of(this).account
        this.clusterarn =`arn:aws:rds:${region}:${account}:cluster:${dbcluster.ref}`;
        this.clusterid = `${dbcluster.ref}`;
    
        new cdk.CfnOutput(this, 'DBClusterARN', {
            value: this.clusterarn
        })
        new cdk.CfnOutput(this, 'DBClusterDBIdentifier', {
            value: this.clusterid
        })
        secret.addTargetAttachment('AttachedSecret', {
            target: this
        })
    
    }

    public asSecretAttachmentTarget(): secretsmanager.SecretAttachmentTargetProps {
        return {
            targetId: this.clusterarn,
            targetType: secretsmanager.AttachmentTargetType.CLUSTER
        };
      }
}