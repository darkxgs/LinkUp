/**
 * إعادة توجيه لمحفظة الماس — السحب والتحويل بالنيابة
 */
import { Redirect } from 'expo-router';

export default function WithdrawScreen() {
  return <Redirect href="/wallet/exchange?tab=withdraw" />;
}
