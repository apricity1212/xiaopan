import {defineStore} from "pinia";
import {ref} from "vue";

export const useUserStore = defineStore('user', () => {
    const id = ref(0)
    const username = ref('')
    const photo = ref('')
    const profile = ref('')

    // 👇 修改点 1：每次刷新网页时，优先从浏览器的本地存储里读取 Token，读不到再默认为空
    const accessToken = ref(localStorage.getItem('access_token') || '')

    const hasPulledUserInfo = ref(false)

    function isLogin() {
        return !!accessToken.value  // 必须带value!!!!!!!!!
    }

    function setAccessToken(token) {
        accessToken.value = token
        // 👇 修改点 2：登录成功拿到 Token 时，立刻备份一份到浏览器的本地存储里
        localStorage.setItem('access_token', token)
    }

    function setUserInfo(data) {
        id.value = data.user_id
        username.value = data.username
        photo.value = data.photo
        profile.value = data.profile
    }

    function logout() {
        id.value = 0
        username.value = ''
        photo.value = ''
        profile.value = ''
        accessToken.value = ''
        // 👇 修改点 3：退出登录时，把本地存储里的 Token 垃圾也清理干净
        localStorage.removeItem('access_token')
    }

    function setHasPulledUserInfo(newStatus) {
        hasPulledUserInfo.value = newStatus
    }

    return {
        id,
        username,
        photo,
        profile,
        accessToken,  // 千万不要忘了！！！！
        isLogin,
        setAccessToken,
        setUserInfo,
        logout,
        hasPulledUserInfo,
        setHasPulledUserInfo,
    }
})