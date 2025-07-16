import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as path from "path";

/**
 * Stack props interface with optional configuration parameters for Smoker Lambda deployment
 */
export interface SmokerStackProps extends cdk.StackProps {
  /** Environment name (dev, test, prod) */
  readonly environment?: string;
  /** Lambda memory size in MB */
  readonly memorySize?: number;
  /** Lambda timeout in minutes */
  readonly timeoutMinutes?: number;
  /** Log retention days */
  readonly logRetentionDays?: logs.RetentionDays;
  /** Flag to create CloudWatch alarms */
  readonly createAlarms?: boolean;
}

/**
 * CDK Stack for deploying Smoker testing framework to AWS Lambda
 */
export class SmokerStack extends cdk.Stack {
  /** Reference to the deployed Lambda function */
  public readonly lambdaFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: SmokerStackProps = {}) {
    super(scope, id, props);

    // Extract configuration with defaults
    const {
      environment = "dev",
      memorySize = 1024,
      timeoutMinutes = 5,
      logRetentionDays = logs.RetentionDays.ONE_WEEK,
      createAlarms = false,
    } = props;

    // Create IAM role for Lambda execution
    const lambdaRole = new iam.Role(this, "SmokerLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ],
      description: `IAM role for Smoker testing framework (${environment})`,
    });

    // Create a CloudWatch log group with specified retention period
    const lambdaLogGroup = new logs.LogGroup(this, "SmokerLogGroup", {
      retention: logRetentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      logGroupName: `/aws/lambda/smoker-${environment}`,
    });

    // Create Lambda function
    this.lambdaFunction = new lambda.Function(this, "SmokerFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "dist/src/index.handler", // Use the Lambda handler wrapper
      code: lambda.Code.fromAsset(path.join(__dirname, "../../"), {
        // Exclude unnecessary files to reduce package size
        exclude: [
          "node_modules/.*",
          "src/.*\\.ts",
          "test/.*",
          ".git",
          "*.md",
          "cdk/**",
          ".github/**",
        ],
      }),
      role: lambdaRole,
      timeout: cdk.Duration.minutes(timeoutMinutes),
      memorySize: memorySize,
      logGroup: lambdaLogGroup,
      environment: {
        NODE_OPTIONS: "--enable-source-maps", // Enable source maps for better error reporting
        LOG_LEVEL: environment === "prod" ? "info" : "debug",
        ENVIRONMENT: environment,
      },
      description: `Smoker testing framework Lambda function (${environment})`,
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
    });

    // Add tags to resources
    cdk.Tags.of(this.lambdaFunction).add("Environment", environment);
    cdk.Tags.of(this.lambdaFunction).add("Project", "smoker");

    // Optional: Create CloudWatch alarms
    if (createAlarms) {
      const errors = this.lambdaFunction.metricErrors({
        period: cdk.Duration.minutes(1),
        statistic: "sum",
      });

      new cloudwatch.Alarm(this, "SmokerLambdaErrorsAlarm", {
        metric: errors,
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: "Alert when Smoker Lambda has errors",
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }

    // Outputs
    new cdk.CfnOutput(this, "SmokerLambdaArn", {
      value: this.lambdaFunction.functionArn,
      description: "The ARN of the Smoker Lambda function",
      exportName: `${id}-LambdaArn`,
    });

    new cdk.CfnOutput(this, "SmokerLambdaName", {
      value: this.lambdaFunction.functionName,
      description: "The name of the Smoker Lambda function",
      exportName: `${id}-LambdaName`,
    });
  }
}
