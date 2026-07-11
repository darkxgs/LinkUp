/**
 * الأصدقاء — تعريف موحّد واحد في كل التطبيق: متابعة متبادلة فقط.
 *
 * كان «صديق الشات» يشمل أعضاء نفس الوكالة بلا أي متابعة، فظهر أشخاص
 * «ما متابعتن ولا متابعيني» بقائمة الأصدقاء واختلف العدد بين الشاشات.
 * كل من يحتاج قائمة/عدّاد أصدقاء يمرّ من getFollowGraph هنا بنفس الحد.
 */
import { getFollowing, getFollowers } from './follow';

/** حد موحّد لقراءة علاقات المتابعة — نفس الحد أينما حُسب «صديق» */
export const FRIEND_FOLLOW_FETCH_LIMIT = 500;

export type FollowGraph = {
  /** من أتابعهم */
  following: Set<string>;
  /** من يتابعونني */
  followers: Set<string>;
  /** أصدقاء = متابعة متبادلة */
  friends: Set<string>;
};

/** مخطط المتابعة الموحّد — المصدر الوحيد لتعريف «صديق» */
export async function getFollowGraph(uid: string): Promise<FollowGraph> {
  const [followingArr, followersArr] = await Promise.all([
    getFollowing(uid, FRIEND_FOLLOW_FETCH_LIMIT),
    getFollowers(uid, FRIEND_FOLLOW_FETCH_LIMIT),
  ]);

  const following = new Set(followingArr.filter((u) => u && u !== uid));
  const followers = new Set(followersArr.filter((u) => u && u !== uid));
  const friends = new Set<string>();
  for (const u of following) {
    if (followers.has(u)) friends.add(u);
  }
  return { following, followers, friends };
}

/** UIDs الأصدقاء — متابعون متبادلون فقط */
export async function getChatFriendUids(uid: string): Promise<Set<string>> {
  const { friends } = await getFollowGraph(uid);
  return friends;
}
