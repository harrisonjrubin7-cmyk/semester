# Bootstrap: the one step Terraform cannot do for itself

Terraform needs somewhere to keep its state before it can manage anything, so
the state store is created by hand, once, and recorded in a change record.
Everything else is code. Requirements and the reasons for them are in
[`docs/infrastructure/DISASTER-RECOVERY.md`](../../docs/infrastructure/DISASTER-RECOVERY.md).

Nothing here is applied by the pipeline. You run it, with your own AWS
credentials, in your own account.

## 1. The bucket

```bash
export B=semester-tfstate-CHANGE-ME      # globally unique
export AWS_REGION=us-west-2              # same region as the production database

aws s3api create-bucket --bucket "$B" --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"

aws s3api put-bucket-versioning --bucket "$B" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption --bucket "$B" --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-public-access-block --bucket "$B" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-lifecycle-configuration --bucket "$B" --lifecycle-configuration \
  '{"Rules":[{"ID":"keep-noncurrent-90d","Status":"Enabled","Filter":{},
    "NoncurrentVersionExpiration":{"NoncurrentDays":90}}]}'

# Refuse any request that is not TLS.
sed "s/BUCKET_NAME/$B/g" infra/bootstrap/bucket-policy.json > /tmp/bucket-policy.json
aws s3api put-bucket-policy --bucket "$B" --policy file:///tmp/bucket-policy.json
```

## 2. The credential

A user that can touch this bucket and nothing else.

```bash
aws iam create-user --user-name semester-terraform-state
sed "s/BUCKET_NAME/$B/g" infra/bootstrap/state-iam-policy.json > /tmp/state-iam-policy.json
aws iam put-user-policy --user-name semester-terraform-state \
  --policy-name state-bucket-only --policy-document file:///tmp/state-iam-policy.json
aws iam create-access-key --user-name semester-terraform-state
```

The access key pair is shown once. Store it as the two environment secrets
`TF_STATE_ACCESS_KEY_ID` and `TF_STATE_SECRET_ACCESS_KEY` (step 3 of
[`ACTIVATION.md`](../../docs/infrastructure/ACTIVATION.md)) and nowhere else.
Rotate it quarterly, in the same review as the other tokens.

`use_lockfile` (native S3 locking) writes a `.tflock` object beside the state
file, which is why the policy allows `PutObject` and `DeleteObject` on the whole
`*/terraform.tfstate*` key family and not only on the state objects themselves.

## 3. Check it, don't trust it

```bash
aws s3api get-bucket-versioning --bucket "$B"              # Status: Enabled
aws s3api get-public-access-block --bucket "$B"            # all four true
aws s3api get-bucket-encryption --bucket "$B"              # AES256
# With the NEW key, the bucket works and a different one does not:
AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… aws s3 ls "s3://$B"
AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… aws s3 ls          # must be AccessDenied
```

The last line is the one that matters: a credential that can list your other
buckets is not scoped.
