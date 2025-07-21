import json
from uuid import uuid4
import boto3
from decimal import Decimal
import os
from datetime import datetime, timezone, timedelta

# 環境変数からテーブル名を取得。Lambdaコンソールで設定することを推奨します。
TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME', 'app-diary-comprehend')

# DynamoDBのDecimal型をJSONシリアライズ可能にするためのヘルパークラス
class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super(DecimalEncoder, self).default(o)

# AWSサービスクライアントを初期化
dynamodb = boto3.resource('dynamodb')
bedrock_runtime = boto3.client('bedrock-runtime')
table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event, context):
    """
    API Gatewayからのリクエストを処理するハンドラ。
    - POST: 日記を登録し、Bedrockで感情パラメータを分析して保存する（重複チェックあり）。
    - GET: 日記の一覧または詳細を取得する。
    """
    print("--- Lambda execution started ---")
    print(f"Received event: {json.dumps(event)}")

    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
    }

    http_method = event.get('httpMethod')

    if http_method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps('CORS preflight successful')
        }

    try:
        if http_method == 'POST':
            body = json.loads(event.get('body', '{}'))
            text = body.get('text')

            if not text or not text.strip():
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'text field is required and cannot be empty.'})
                }

            # --- ★★★ 重複チェックロジック ★★★ ---
            timestamp = body.get('timestamp', datetime.utcnow().isoformat())

            # --- ★★★ タイムゾーン変換ロジック (ここが重要) ★★★ ---
            # フロントエンドから送られてきたUTCのタイムスタンプをJSTに変換して日付を決定
            try:
                # ISOフォーマットの文字列をdatetimeオブジェクトに変換
                utc_dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                # JSTのタイムゾーンを定義 (UTC+9)
                jst = timezone(timedelta(hours=9))
                # JSTに変換
                jst_dt = utc_dt.astimezone(jst)
                # JSTでの日付(YYYY-MM-DD)を抽出
                entry_date = jst_dt.strftime('%Y-%m-%d')
            except ValueError:
                # 予期せぬフォーマットの場合のフォールバック
                entry_date = timestamp.split('T')[0]
            # --- ★★★ タイムゾーン変換ここまで ★★★ ---

            # GSIをクエリして、同じ日付のエントリが存在するか確認
            response = table.query(
                IndexName='date-index',
                KeyConditionExpression=boto3.dynamodb.conditions.Key('date').eq(entry_date)
            )

            if response['Count'] > 0:
                existing_item = response['Items'][0]
                print(f"Duplicate entry found for date {entry_date}. ID: {existing_item['id']}")
                return {
                    'statusCode': 409,  # Conflict
                    'headers': headers,
                    'body': json.dumps({'error': 'An entry for this date already exists.', 'item': existing_item}, cls=DecimalEncoder, ensure_ascii=False)
                }
            # --- ★★★ 重複チェックここまで ★★★ ---

            prompt = f"""あなたは文章を分析し、結果をJSON形式で返すAPIです。
以下の文章を分析し、指定された項目を含むJSONオブジェクトを生成してください。
説明や前置きは一切不要で、RFC 8259に準拠した有効なJSONオブジェクトのみを出力してください。

{{
  "emotion_params": {{
    "joy": <0から100の整数>,
    "anger": <0から100の整数>,
    "sadness": <0から100の整数>,
    "pleasure": <0から100の整数>
  }},
  "evaluation": "現在の感情状態を分析した100文字程度の文章。文章中ではダブルクォーテーション（\\"）を使用しないでください。",
  "advice": "感情状態を改善または維持するための100文字程度のアドバイス。文章中ではダブルクォーテーション（\\"）を使用しないでください。"
}}
---
[分析対象の文章]
{text}
"""
            print(f"Prompt to be sent to Bedrock: \n{prompt}")

            messages = [{"role": "user", "content": prompt}]
            claude_payload = {
                "anthropic_version": "bedrock-2023-05-31",
                "messages": messages,
                "max_tokens": 500,
            }

            emotion_params, evaluation, advice = {}, "", ""
            try:
                response = bedrock_runtime.invoke_model(
                    body=json.dumps(claude_payload),
                    modelId="anthropic.claude-3-haiku-20240307-v1:0",
                    accept="application/json",
                    contentType="application/json"
                )
                response_body = json.loads(response.get('body').read())
                print(f"Raw response from Bedrock: {json.dumps(response_body, indent=2)}")

                analysis_result_str = response_body['content'][0]['text']
                print(f"Content string from Bedrock: \n---\n{analysis_result_str}\n---")

                json_start = analysis_result_str.find('{')
                json_end = analysis_result_str.rfind('}')
                analysis_result_str = analysis_result_str[json_start:json_end+1]
                print(f"String to be parsed as JSON: \n---\n{analysis_result_str}\n---")

                analysis_result = json.loads(analysis_result_str, parse_float=Decimal)
                emotion_params = analysis_result.get("emotion_params", {})
                evaluation = analysis_result.get("evaluation", "")
                advice = analysis_result.get("advice", "")
                print("Successfully parsed JSON from Bedrock response.")

                # ★★★ 最も強い感情を決定するロジック ★★★
                strongest_emotion = ""
                if emotion_params:
                    strongest_emotion = max(emotion_params, key=emotion_params.get)
                # ★★★ ここまで ★★★

            except Exception as bedrock_error:
                print(f"!!! Bedrock or JSON parsing error: {bedrock_error}")
                print(f"!!! Type of error: {type(bedrock_error)}")
                strongest_emotion = "" # エラー時は空にする

            # --- ★★★ここが重要な修正点です★★★ ---
            # DynamoDBに保存するitemを作成
            item = {
                'id': str(uuid4()),
                'text': text,
                'timestamp': timestamp,
                'date': entry_date,  # 正しく計算された日付を保存
                'strongest_emotion': strongest_emotion if strongest_emotion else None,
                'emotion_params': emotion_params if emotion_params else None,
                'emotion_evaluation': evaluation if evaluation else None,
                'emotion_advice': advice if advice else None
            }

            # DynamoDBは空文字列を許可しないため、値がNoneのキーをitemから取り除く
            item_to_save = {k: v for k, v in item.items() if v is not None}
            # --- ★★★修正ここまで★★★ ---

            print(f"Item to be saved to DynamoDB: {json.dumps(item_to_save, cls=DecimalEncoder, indent=2, ensure_ascii=False)}")
            table.put_item(Item=item_to_save)
            print("--- Successfully saved to DynamoDB. ---")

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps({"message": "保存したよ〜！", "item": item_to_save}, cls=DecimalEncoder, ensure_ascii=False)
            }

        elif http_method == 'GET':
            query_params = event.get('queryStringParameters')

            # --- ★★★ 日付指定でのGETに対応 ★★★ ---
            if query_params and 'date' in query_params:
                query_date = query_params['date']
                print(f"Querying for date: {query_date}")
                response = table.query(
                    IndexName='date-index',
                    KeyConditionExpression=boto3.dynamodb.conditions.Key('date').eq(query_date)
                )
                items = response.get('Items', [])
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps(items, cls=DecimalEncoder)}
            # --- ★★★ 日付指定GETここまで ★★★ ---

            # ID指定でのGET (変更なし)
            path_params = event.get('pathParameters')
            if path_params and 'id' in path_params:
                response = table.get_item(Key={'id': path_params['id']})
                item = response.get('Item')
                if not item:
                    return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Diary not found.'})}
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps(item, cls=DecimalEncoder)}

            # 全件取得 (変更なし)
            else:
                response = table.scan()
                items = response.get('Items', [])
                sorted_items = sorted(items, key=lambda x: x.get('timestamp', ''), reverse=True)
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps(sorted_items, cls=DecimalEncoder)}
        else:
            return {
                'statusCode': 405,
                'headers': headers,
                'body': json.dumps({'error': f"Unsupported method '{http_method}'"})
            }

    except Exception as e:
        print(f"!!! An unhandled exception occurred in handler: {e}")
        print(f"!!! Type of error: {type(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal Server Error'})
        }
